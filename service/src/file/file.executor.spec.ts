import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { FileExecutor, FileAction } from './file.executor';
import { FileService } from './file.service';
import { FileProcessService } from './file-process.service';
import { StorageService } from './storage/storage.service';
import { PrismaService } from '../common/prisma/prisma.service';

describe('FileExecutor', () => {
  let executor: FileExecutor;
  let fileService: FileService;
  let fileProcessService: FileProcessService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileExecutor,
        {
          provide: FileService,
          useValue: {
            upload: jest.fn(),
            download: jest.fn(),
            delete: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: FileProcessService,
          useValue: {
            addTask: jest.fn(),
            executeTask: jest.fn(),
            getTaskStatus: jest.fn(),
          },
        },
        {
          provide: StorageService,
          useValue: {
            store: jest.fn(),
            retrieve: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            file: {
              aggregate: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    executor = module.get<FileExecutor>(FileExecutor);
    fileService = module.get<FileService>(FileService);
    fileProcessService = module.get<FileProcessService>(FileProcessService);
  });

  it('应该被定义', () => {
    expect(executor).toBeDefined();
  });

  describe('execute', () => {
    it('应该拒绝不允许的操作', async () => {
      const skill = {
        code: 'test_skill',
        config: JSON.stringify({ allowedActions: ['info'] }),
      };
      const params = { action: 'delete', fileId: '123' };

      await expect(executor.execute(skill, params)).rejects.toThrow(
        BadRequestException,
      );
      await expect(executor.execute(skill, params)).rejects.toThrow(
        '该技能不允许执行 delete 操作',
      );
    });

    it('应该成功执行 info 操作', async () => {
      const skill = {
        code: 'test_skill',
        config: JSON.stringify({ allowedActions: ['info'] }),
      };
      const params = { action: 'info', fileId: '123' };
      const mockFile = {
        id: '123',
        fileName: 'test.pdf',
        fileSize: 1024,
      };

      jest.spyOn(fileService, 'findOne').mockResolvedValue(mockFile as any);

      const result = await executor.execute(skill, params);

      expect(result).toEqual(mockFile);
      expect(fileService.findOne).toHaveBeenCalledWith('123');
    });

    it('应该成功执行 list 操作', async () => {
      const skill = {
        code: 'test_skill',
        config: JSON.stringify({
          allowedActions: ['list'],
          businessType: 'agent',
        }),
      };
      const params = { action: 'list', page: 1, pageSize: 10 };
      const mockResult = {
        list: [{ id: '1', fileName: 'test.pdf' }],
        total: 1,
        page: 1,
        pageSize: 10,
      };

      jest.spyOn(fileService, 'findAll').mockResolvedValue(mockResult as any);

      const result = await executor.execute(skill, params);

      expect(result).toEqual(mockResult);
      expect(fileService.findAll).toHaveBeenCalledWith(
        {
          page: 1,
          pageSize: 10,
          fileType: undefined,
          fileName: undefined,
          businessType: 'agent',
        },
        undefined,
      );
    });

    it('应该成功执行 delete 操作', async () => {
      const skill = {
        code: 'test_skill',
        config: JSON.stringify({ allowedActions: ['delete'] }),
      };
      const params = { action: 'delete', fileId: '123' };

      jest.spyOn(fileService, 'delete').mockResolvedValue(undefined);

      const result = await executor.execute(skill, params);

      expect(result).toEqual({ success: true, message: '文件已删除' });
      expect(fileService.delete).toHaveBeenCalledWith('123', false);
    });

    it('应该成功执行 exists 操作（文件存在）', async () => {
      const skill = {
        code: 'test_skill',
        config: JSON.stringify({ allowedActions: ['exists'] }),
      };
      const params = { action: 'exists', fileId: '123' };
      const mockFile = {
        id: '123',
        fileName: 'test.pdf',
      };

      jest.spyOn(fileService, 'findOne').mockResolvedValue(mockFile as any);

      const result = await executor.execute(skill, params);

      expect(result).toEqual({ exists: true, file: mockFile });
    });

    it('应该成功执行 exists 操作（文件不存在）', async () => {
      const skill = {
        code: 'test_skill',
        config: JSON.stringify({ allowedActions: ['exists'] }),
      };
      const params = { action: 'exists', fileId: '999' };

      jest.spyOn(fileService, 'findOne').mockRejectedValue(new Error('文件不存在'));

      const result = await executor.execute(skill, params);

      expect(result).toEqual({ exists: false });
    });

    it('应该成功执行 process 操作', async () => {
      const skill = {
        code: 'test_skill',
        config: JSON.stringify({
          allowedActions: ['process'],
          allowedProcessTypes: ['compress'],
        }),
      };
      const params = {
        action: 'process',
        fileId: '123',
        processType: 'compress',
        options: { quality: 80 },
      };
      const mockTaskResult = {
        status: 'completed',
        result: JSON.stringify({ compressedSize: 500 }),
      };

      jest.spyOn(fileProcessService, 'addTask').mockResolvedValue('task-123');
      jest.spyOn(fileProcessService, 'executeTask').mockResolvedValue(undefined);
      jest
        .spyOn(fileProcessService, 'getTaskStatus')
        .mockResolvedValue(mockTaskResult as any);

      const result = await executor.execute(skill, params);

      expect(result).toEqual({
        taskId: 'task-123',
        status: 'completed',
        result: { compressedSize: 500 },
      });
    });

    it('应该拒绝不允许的处理类型', async () => {
      const skill = {
        code: 'test_skill',
        config: JSON.stringify({
          allowedActions: ['process'],
          allowedProcessTypes: ['compress'],
        }),
      };
      const params = {
        action: 'process',
        fileId: '123',
        processType: 'watermark',
      };

      await expect(executor.execute(skill, params)).rejects.toThrow(
        BadRequestException,
      );
      await expect(executor.execute(skill, params)).rejects.toThrow(
        '不允许的处理类型: watermark',
      );
    });

    it('应该拒绝不支持的文件操作', async () => {
      const skill = {
        code: 'test_skill',
        config: JSON.stringify({ allowedActions: ['invalid'] }),
      };
      const params = { action: 'invalid' };

      await expect(executor.execute(skill, params)).rejects.toThrow(
        BadRequestException,
      );
      await expect(executor.execute(skill, params)).rejects.toThrow(
        '不支持的文件操作: invalid',
      );
    });
  });

  describe('validatePath', () => {
    it('应该拒绝包含 .. 的路径', () => {
      const filePath = '../../../etc/passwd';

      expect(() => {
        (executor as any).validatePath(filePath);
      }).toThrow(BadRequestException);
      expect(() => {
        (executor as any).validatePath(filePath);
      }).toThrow('非法文件路径');
    });

    it('应该接受合法路径', () => {
      const filePath = '/uploads/images/test.png';

      expect(() => {
        (executor as any).validatePath(filePath);
      }).not.toThrow();
    });
  });

  describe('checkQuota', () => {
    it('应该在配额未满时通过检查', async () => {
      const config = { maxStorage: 1000000 };
      const prismaService = (executor as any).prisma;

      jest.spyOn(prismaService.file, 'aggregate').mockResolvedValue({
        _sum: { fileSize: 500000 },
      });

      await expect(
        (executor as any).checkQuota('app-001', config),
      ).resolves.not.toThrow();
    });

    it('应该在配额已满时抛出异常', async () => {
      const config = { maxStorage: 1000000 };
      const prismaService = (executor as any).prisma;

      jest.spyOn(prismaService.file, 'aggregate').mockResolvedValue({
        _sum: { fileSize: 1000000 },
      });

      await expect(
        (executor as any).checkQuota('app-001', config),
      ).rejects.toThrow(BadRequestException);
      await expect(
        (executor as any).checkQuota('app-001', config),
      ).rejects.toThrow('存储空间已满');
    });

    it('应该在未配置配额时跳过检查', async () => {
      const config = {};

      await expect(
        (executor as any).checkQuota('app-001', config),
      ).resolves.not.toThrow();
    });
  });
});
