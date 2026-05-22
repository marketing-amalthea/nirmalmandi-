import { Router, Request, Response } from 'express';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { authenticate, successResponse, errorResponse } from '@nirmalmandi/shared';
import { v4 as uuidv4 } from 'uuid';

export const imagesRouter = Router();

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });

// ── POST /images/presigned — Get S3 presigned upload URL ─────
imagesRouter.post('/presigned', authenticate, async (req: Request, res: Response) => {
  const { filename, content_type, listing_id } = req.body;
  if (!filename || !content_type) {
    res.status(400).json(errorResponse('filename and content_type required'));
    return;
  }

  const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
  const key = `listings/${listing_id || req.user!.profile_id}/${uuidv4()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    ContentType: content_type,
    Metadata: { uploaded_by: req.user!.sub },
  });

  const presigned_url = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 min
  const cdn_url = `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`;

  res.json(successResponse({ presigned_url, cdn_url, key }));
});
