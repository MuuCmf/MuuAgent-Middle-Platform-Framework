import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { DocumentService } from './document.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { QueryDocumentListDto } from './dto/query-document-list.dto';
import { DeleteDocumentDto } from './dto/delete-document.dto';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { success, fail } from '../common/response/api.response';

/**
 * 文档管理控制器
 */
@Controller('kb/document')
@ApiTags('知识库文档管理')
@ApiBearerAuth()
@UseGuards(ApiKeyGuard)
export class DocumentController {
  /**
   * 构造函数
   * @param documentService 文档服务
   */
  constructor(private readonly documentService: DocumentService) {}

  /**
   * 上传文档
   * @param dto 上传参数
   * @param file 文件对象
   * @returns {Promise<any>} 上传结果
   */
  @Post('upload')
  @ApiOperation({ summary: '上传文档', description: '上传单个文档到知识库' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: '上传成功' })
  @ApiResponse({ status: 400, description: '参数错误' })
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      return fail(400, '请选择要上传的文件');
    }
    const result = await this.documentService.upload(dto, file);
    return success(result, '文档上传成功');
  }

  /**
   * 批量上传文档
   * @param dto 上传参数
   * @param files 文件对象列表
   * @returns {Promise<any>} 上传结果
   */
  @Post('batch-upload')
  @ApiOperation({ summary: '批量上传文档', description: '批量上传多个文档到知识库' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: '上传成功' })
  @ApiResponse({ status: 400, description: '参数错误' })
  @UseInterceptors(FilesInterceptor('files', 10))
  async batchUpload(
    @Body() dto: UploadDocumentDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      return fail(400, '请选择要上传的文件');
    }
    const result = await this.documentService.batchUpload(dto, files);
    return success(result, '批量上传成功');
  }

  /**
   * 查询文档列表
   * @param dto 查询参数
   * @returns {Promise<any>} 查询结果
   */
  @Get('list')
  @ApiOperation({ summary: '查询文档列表', description: '根据条件查询知识库文档列表' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async findAll(@Query() dto: QueryDocumentListDto) {
    const result = await this.documentService.findAll(dto);
    return success(result, '查询成功');
  }

  /**
   * 删除文档
   * @param dto 删除参数
   * @returns {Promise<any>} 删除结果
   */
  @Post('delete')
  @ApiOperation({ summary: '删除文档', description: '从知识库中删除指定文档' })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 404, description: '文档不存在' })
  async delete(@Body() dto: DeleteDocumentDto) {
    const result = await this.documentService.delete(dto);
    return success(result, '删除文档成功');
  }
}
