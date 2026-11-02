package com.anwen.xiaoying.identity.service;

import com.anwen.xiaoying.identity.dto.UserResponse;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;

/** 管理演示身份。当前用户仅从服务端会话取得，不接受业务请求指定所有者。 */
public interface IdentityService {
    List<UserResponse> demoUsers();

    /** 校验目标用户成功后再切换会话；无效目标不破坏旧会话。 */
    UserResponse select(HttpServletRequest request, String userId);

    /** 无有效会话时抛出 UNAUTHENTICATED。 */
    UserResponse current(HttpServletRequest request);

    void logout(HttpServletRequest request);
}
