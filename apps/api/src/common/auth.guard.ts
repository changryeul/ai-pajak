import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    const rawUserId = req.headers['x-user-id'];

   /*   

    if (!rawUserId) {
      throw new ForbiddenException('x-user-id header is required');
    }
   */
      // ✅ 개발 단계용: 헤더가 없으면 default user 주입
    const userId = rawUserId
      ? Array.isArray(rawUserId)
        ? rawUserId[0]
        : rawUserId
      : '1';
    /*  
    const userId = Array.isArray(rawUserId)
      ? rawUserId[0]
      : rawUserId;

    if (!userId) {
      throw new ForbiddenException('Invalid x-user-id');
    }

    req.user = {
      id: BigInt(userId),
    };
    */
    req.user = {
      id: BigInt(userId),
      role: 'ADMIN',
    };

    return true;
  }
}