import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * 获取当前登录管理员装饰器
 * 从请求对象中提取管理员信息
 */
export const CurrentAdmin = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.admin;
  },
);
