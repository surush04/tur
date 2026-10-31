import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'crypto';
import { mkdirSync } from 'fs';
import { extname, join } from 'path';
import { diskStorage } from 'multer';
import { Role } from '../generated/prisma/client';
import { Roles } from '../auth/guards';

const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);

@ApiTags('uploads')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('uploads')
export class UploadsController {
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        if (!allowed.has(file.mimetype)) {
          callback(new BadRequestException({ message: 'Upload a JPEG, PNG, or WebP image.', code: 'UPLOAD' }), false);
          return;
        }
        callback(null, true);
      },
      storage: diskStorage({
        destination: (_req, _file, callback) => {
          const dir = join(process.cwd(), 'uploads');
          mkdirSync(dir, { recursive: true });
          callback(null, dir);
        },
        filename: (_req, file, callback) => {
          const extension = extname(file.originalname).toLowerCase();
          const safe = ['.jpg', '.jpeg', '.png', '.webp'].includes(extension) ? extension : '.jpg';
          callback(null, `${randomBytes(16).toString('hex')}${safe}`);
        },
      }),
    }),
  )
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException({ message: 'Choose an image file.', code: 'UPLOAD' });
    }
    return { data: { url: `/uploads/${file.filename}` } };
  }
}
