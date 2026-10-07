import { NextRequest } from 'next/server';
import crypto from 'crypto';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const BUCKET_NAME = 'review-photos';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const projectId = (formData.get('projectId') as string | null) || 'general';

    if (!file) {
      return Response.json({ error: 'No image file provided' }, { status: 400 });
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
      return Response.json(
        { error: 'Invalid file format. Please upload an image (JPG, PNG, WebP, etc.).' },
        { status: 400 }
      );
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return Response.json(
        { error: 'File size exceeds 10MB limit.' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Get file extension
    let ext = path.extname(file.name).toLowerCase();
    if (!ext || ext === '.') {
      ext = file.type === 'image/png' ? '.png' : file.type === 'image/webp' ? '.webp' : '.jpg';
    }

    const uniqueId = crypto.randomUUID();
    const filePath = `${projectId}/${Date.now()}_${uniqueId}${ext}`;

    const supabaseUrl = env.SUPABASE_URL();
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY();

    // If Supabase Storage is configured, upload to cloud storage
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, buffer, {
          contentType: file.type || 'image/jpeg',
          upsert: true,
        });

      if (error) {
        console.error('Supabase storage upload error:', error);
        return Response.json(
          { error: `Cloud storage error: ${error.message}` },
          { status: 500 }
        );
      }

      const { data: publicData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(data.path);

      return Response.json({
        success: true,
        url: publicData.publicUrl,
        fileName: filePath,
        provider: 'supabase',
      });
    }

    // Fallback: Data URL if cloud storage env variables are not yet populated
    // This allows Vercel deployments to succeed without crashing with EROFS read-only disk error
    const base64Data = buffer.toString('base64');
    const dataUrl = `data:${file.type || 'image/jpeg'};base64,${base64Data}`;

    return Response.json({
      success: true,
      url: dataUrl,
      fileName: filePath,
      provider: 'inline_fallback',
    });
  } catch (error) {
    console.error('Error handling file upload:', error);
    return Response.json(
      { error: 'Failed to process image upload' },
      { status: 500 }
    );
  }
}
