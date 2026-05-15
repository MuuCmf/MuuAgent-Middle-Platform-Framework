import { Module, Global } from '@nestjs/common';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { FileProcessService } from './file-process.service';
import { StorageService } from './storage/storage.service';
import { LocalStorage } from './storage/local.storage';
import { OssStorage } from './storage/oss.storage';
import { ImageProcessor } from './processor/image.processor';
import { FileExecutor } from './file.executor';

@Global()
@Module({
  controllers: [FileController],
  providers: [
    FileService,
    FileProcessService,
    StorageService,
    LocalStorage,
    OssStorage,
    ImageProcessor,
    FileExecutor,
  ],
  exports: [FileService, FileProcessService, StorageService, FileExecutor],
})
export class FileModule {}
