import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sharp from 'sharp';

/**
 * 图片处理器
 */
@Injectable()
export class ImageProcessor {
  private readonly logger = new Logger(ImageProcessor.name);
  private readonly defaultQuality: number;

  constructor(private readonly configService: ConfigService) {
    this.defaultQuality = this.configService.get<number>('IMAGE_QUALITY', 80);
  }

  /**
   * 处理图片
   * @param file 文件记录
   * @param taskType 任务类型
   * @param options 处理选项
   * @returns 处理结果
   */
  async process(
    file: any,
    taskType: string,
    options: Record<string, any>,
  ): Promise<Record<string, any>> {
    this.logger.log(`处理图片: ${file.id}, 类型: ${taskType}`);

    switch (taskType) {
      case 'compress':
        return this.compress(file, options);
      case 'resize':
        return this.resize(file, options);
      case 'crop':
        return this.crop(file, options);
      case 'watermark':
        return this.watermark(file, options);
      case 'thumbnail':
        return this.thumbnail(file, options);
      case 'convert':
        return this.convert(file, options);
      default:
        throw new Error(`不支持的处理类型: ${taskType}`);
    }
  }

  /**
   * 压缩图片
   * @param file 文件记录
   * @param options 压缩选项
   * @returns 处理结果
   */
  private async compress(file: any, options: Record<string, any>): Promise<Record<string, any>> {
    const quality = options.quality || this.defaultQuality;
    const inputBuffer = await this.readImage(file.filePath);

    const outputBuffer = await sharp(inputBuffer)
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    const originalSize = inputBuffer.length;
    const compressedSize = outputBuffer.length;
    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);

    this.logger.log(`图片压缩完成: 原大小 ${originalSize}, 压缩后 ${compressedSize}, 压缩率 ${compressionRatio}%`);

    return {
      originalSize,
      compressedSize,
      compressionRatio: `${compressionRatio}%`,
      quality,
    };
  }

  /**
   * 调整图片尺寸
   * @param file 文件记录
   * @param options 调整选项
   * @returns 处理结果
   */
  private async resize(file: any, options: Record<string, any>): Promise<Record<string, any>> {
    const { width, height, fit = 'cover' } = options;
    const inputBuffer = await this.readImage(file.filePath);

    const outputBuffer = await sharp(inputBuffer)
      .resize(width, height, { fit: fit as any })
      .toBuffer();

    const metadata = await sharp(outputBuffer).metadata();

    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
    };
  }

  /**
   * 裁剪图片
   * @param file 文件记录
   * @param options 裁剪选项
   * @returns 处理结果
   */
  private async crop(file: any, options: Record<string, any>): Promise<Record<string, any>> {
    const { x, y, width, height } = options;
    const inputBuffer = await this.readImage(file.filePath);

    const outputBuffer = await sharp(inputBuffer)
      .extract({ left: x, top: y, width, height })
      .toBuffer();

    const metadata = await sharp(outputBuffer).metadata();

    return {
      x,
      y,
      width: metadata.width,
      height: metadata.height,
    };
  }

  /**
   * 添加水印
   * @param file 文件记录
   * @param options 水印选项
   * @returns 处理结果
   */
  private async watermark(file: any, options: Record<string, any>): Promise<Record<string, any>> {
    const { text, fontSize = 24, color = '#ffffff', opacity = 0.5, position = 'bottom-right' } = options;
    const inputBuffer = await this.readImage(file.filePath);

    const imageMetadata = await sharp(inputBuffer).metadata();
    const imageWidth = imageMetadata.width || 0;
    const imageHeight = imageMetadata.height || 0;

    const svgText = `
      <svg width="${imageWidth}" height="${imageHeight}">
        <text x="${imageWidth - 20}" y="${imageHeight - 20}" 
              font-family="Arial" font-size="${fontSize}" fill="${color}" 
              fill-opacity="${opacity}" text-anchor="end">
          ${text}
        </text>
      </svg>
    `;

    const watermarkBuffer = Buffer.from(svgText);

    const outputBuffer = await sharp(inputBuffer)
      .composite([
        {
          input: watermarkBuffer,
          blend: 'over',
        },
      ])
      .toBuffer();

    return {
      text,
      fontSize,
      color,
      opacity,
      position,
    };
  }

  /**
   * 生成缩略图
   * @param file 文件记录
   * @param options 缩略图选项
   * @returns 处理结果
   */
  private async thumbnail(file: any, options: Record<string, any>): Promise<Record<string, any>> {
    const { width = 200, height = 200 } = options;
    const inputBuffer = await this.readImage(file.filePath);

    const outputBuffer = await sharp(inputBuffer)
      .resize(width, height, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer();

    const metadata = await sharp(outputBuffer).metadata();

    return {
      width: metadata.width,
      height: metadata.height,
      size: outputBuffer.length,
    };
  }

  /**
   * 格式转换
   * @param file 文件记录
   * @param options 转换选项
   * @returns 处理结果
   */
  private async convert(file: any, options: Record<string, any>): Promise<Record<string, any>> {
    const { format = 'jpeg', quality = 80 } = options;
    const inputBuffer = await this.readImage(file.filePath);

    let sharpInstance = sharp(inputBuffer);

    switch (format) {
      case 'jpeg':
      case 'jpg':
        sharpInstance = sharpInstance.jpeg({ quality });
        break;
      case 'png':
        sharpInstance = sharpInstance.png();
        break;
      case 'webp':
        sharpInstance = sharpInstance.webp({ quality });
        break;
      case 'avif':
        sharpInstance = sharpInstance.avif({ quality });
        break;
      default:
        throw new Error(`不支持的目标格式: ${format}`);
    }

    const outputBuffer = await sharpInstance.toBuffer();
    const metadata = await sharp(outputBuffer).metadata();

    return {
      format: metadata.format,
      size: outputBuffer.length,
    };
  }

  /**
   * 读取图片文件
   * @param filePath 文件路径
   * @returns 文件缓冲区
   */
  private async readImage(filePath: string): Promise<Buffer> {
    const fs = require('fs');
    const path = require('path');
    const uploadDir = this.configService.get<string>('FILE_UPLOAD_DIR', './uploads');
    const fullPath = path.join(uploadDir, filePath);
    return fs.readFileSync(fullPath);
  }
}
