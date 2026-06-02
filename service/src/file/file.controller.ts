import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Body,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  StreamableFile,
  Header,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { FileService } from './file.service';
import { UploadFileDto, QueryFileListDto, ProcessFileDto, DeleteFileDto } from './dto/file.dto';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantPermissionGuard } from '../common/guards/tenant-permission.guard';
import { RequireTenantPermission } from '../common/decorators/tenant-permission.decorator';

@ApiTags('文件管理')
@ApiBearerAuth('api-key')
@UseGuards(TenantGuard, TenantPermissionGuard)
@Controller('file')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  /**
   * 上传单个文件
   * @param file 文件
   * @param dto 上传参数
   * @param request 请求对象
   * @returns 文件信息
   */
  @Post('upload')
  @ApiOperation({ summary: '上传单个文件' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @RequireTenantPermission('file', 'upload')
  async uploadSingle(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
    @Req() request: Request,
  ) {
    const uid = (request as any).user?.uid;
    const appCode = (request as any).appCode;

    return this.fileService.upload(file, {
      ...dto,
      uid,
      appCode,
    });
  }

  /**
   * 批量上传文件
   * @param files 文件数组
   * @param dto 上传参数
   * @param request 请求对象
   * @returns 文件信息数组
   */
  @Post('upload/multiple')
  @ApiOperation({ summary: '批量上传文件' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 10))
  @RequireTenantPermission('file', 'upload')
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: UploadFileDto,
    @Req() request: Request,
  ) {
    const uid = (request as any).user?.uid;
    const appCode = (request as any).appCode;

    return this.fileService.uploadMultiple(files, {
      ...dto,
      uid,
      appCode,
    });
  }

  /**
   * 下载文件
   * @param id 文件ID
   * @returns 文件流
   */
  @Get('download/:id')
  @ApiOperation({ summary: '下载文件' })
  @Header('Content-Disposition', 'attachment')
  @RequireTenantPermission('file', 'download')
  async download(@Param('id') id: string) {
    const result = await this.fileService.download(id);
    return new StreamableFile(result.stream as any, {
      disposition: `attachment; filename="${encodeURIComponent(result.fileName)}"`,
      type: result.mimeType,
    });
  }

  /**
   * 获取文件详情
   * @param id 文件ID
   * @returns 文件信息
   */
  @Get(':id')
  @ApiOperation({ summary: '获取文件详情' })
  async findOne(@Param('id') id: string) {
    return this.fileService.findOne(id);
  }

  /**
   * 查询文件列表
   * @param query 查询参数
   * @param request 请求对象
   * @returns 文件列表
   */
  @Get()
  @ApiOperation({ summary: '查询文件列表' })
  async findAll(@Query() query: QueryFileListDto, @Req() request: Request) {
    const appCode = (request as any).appCode;
    return this.fileService.findAll(query, appCode);
  }

  /**
   * 删除文件
   * @param id 文件ID
   * @param dto 删除参数
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除文件' })
  @RequireTenantPermission('file', 'delete')
  async delete(@Param('id') id: string, @Body() dto: DeleteFileDto) {
    await this.fileService.delete(id, dto.permanent);
    return { success: true };
  }
}
