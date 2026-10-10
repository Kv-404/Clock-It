import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables. See .env.example');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Auth Helpers ────────────────────────────────────────────────────────────

export async function signUpWithEmail(email: string, password: string) {
  return supabase.auth.signUp({ email, password });
}

export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/` },
  });
}

export async function signOutUser() {
  return supabase.auth.signOut();
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => subscription.unsubscribe();
}

export async function getCurrentUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ── Storage & Database Helpers ──────────────────────────────────────────────

interface UploadResult {
  publicUrl: string;
  error?: string;
}

/**
 * Uploads a file blob to the Supabase Storage bucket 'captures' partitioned by userId
 */
export async function uploadCapture(
  blob: Blob,
  filename: string,
  type: 'video' | 'photo',
  filterName: string,
  userId: string
): Promise<UploadResult> {
  try {
    const folder = type === 'video' ? 'videos' : 'photos';
    const filePath = `${userId}/${folder}/${filename}`;
    
    const { error: uploadError } = await supabase.storage
      .from('captures')
      .upload(filePath, blob, {
        cacheControl: '3600',
        upsert: true,
        contentType: blob.type
      });

    if (uploadError) {
      return { publicUrl: '', error: `Storage upload error: ${uploadError.message}` };
    }

    const publicUrl = `${window.location.origin}/media/${filePath}`;

    const { error: dbError } = await supabase
      .from('captures')
      .insert([
        {
          filename,
          file_url: publicUrl,
          type,
          filter_name: filterName,
          user_id: userId
        }
      ]);

    if (dbError) {
      return { publicUrl: '', error: `Database logging error: ${dbError.message}` };
    }

    return { publicUrl };
  } catch (err) {
    return {
      publicUrl: '',
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

/**
 * Fetches all captures logged for a specific user ID.
 * Automatically cleans up expired captures (older than 2 hours) from both storage and DB.
 */
export async function fetchCaptures(userId: string) {
  try {
    // Clean up expired captures first
    await cleanupExpiredCaptures(userId);

    const { data, error } = await supabase
      .from('captures')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[CLOCKIT] Fetch captures error:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[CLOCKIT] Fetch captures failed:', err);
    return [];
  }
}

const EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours

function storagePathFromUrl(fileUrl: string): string | null {
  try {
    const url = new URL(fileUrl, window.location.origin);
    const media = url.pathname.match(/^\/media\/(.+)$/);
    if (media) return decodeURIComponent(media[1]);
    const legacy = url.pathname.match(/\/storage\/v1\/object\/(?:public|authenticated|sign)\/captures\/(.+)$/);
    if (legacy) return decodeURIComponent(legacy[1]);
  } catch {
    return null;
  }
  return null;
}

/**
 * Deletes captures older than 2 hours from both Supabase Storage and the database.
 * Runs silently — failures don't block the main fetch flow.
 */
async function cleanupExpiredCaptures(userId: string) {
  try {
    const cutoff = new Date(Date.now() - EXPIRY_MS).toISOString();

    const { data: expired, error } = await supabase
      .from('captures')
      .select('id, file_url')
      .eq('user_id', userId)
      .lt('created_at', cutoff);

    if (error || !expired || expired.length === 0) return;

    // Delete storage files in bulk
    const storagePaths = expired
      .map((item: any) => {
        return storagePathFromUrl(item.file_url);
      })
      .filter(Boolean) as string[];

    if (storagePaths.length > 0) {
      await supabase.storage.from('captures').remove(storagePaths);
    }

    // Delete DB rows in bulk
    const expiredIds = expired.map((item: any) => item.id);
    await supabase
      .from('captures')
      .delete()
      .in('id', expiredIds);

    console.log(`[CLOCKIT] Cleaned up ${expired.length} expired capture(s)`);
  } catch (err) {
    console.warn('[CLOCKIT] Expired capture cleanup failed (non-blocking):', err);
  }
}

/**
 * Deletes a capture from both Supabase Storage and PostgreSQL database log
 */
export async function deleteCapture(id: string, fileUrl: string): Promise<boolean> {
  try {
    const filePath = storagePathFromUrl(fileUrl);
    if (filePath) {
      const { error: storageError } = await supabase.storage
        .from('captures')
        .remove([filePath]);
      if (storageError) {
        console.warn('[CLOCKIT] Storage file delete failed (proceeding with DB delete):', storageError.message);
      }
    }

    const { error: dbError } = await supabase
      .from('captures')
      .delete()
      .eq('id', id);

    if (dbError) {
      console.error('[CLOCKIT] Database row delete failed:', dbError.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[CLOCKIT] Delete capture error:', err);
    return false;
  }
}

