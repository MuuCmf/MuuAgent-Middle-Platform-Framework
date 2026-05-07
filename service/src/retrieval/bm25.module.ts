import { Module, Global } from '@nestjs/common';
import { BM25Service } from './bm25.service';

/**
 * BM25检索模块
 * 提供基于BM25算法的文本检索功能
 */
@Global()
@Module({
  providers: [BM25Service],
  exports: [BM25Service],
})
export class BM25Module {}
