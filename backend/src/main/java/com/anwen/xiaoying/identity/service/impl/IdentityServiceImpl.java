package com.anwen.xiaoying.identity.service.impl;

import com.anwen.xiaoying.common.BusinessException;
import com.anwen.xiaoying.common.Ids;
import com.anwen.xiaoying.config.AppProperties;
import com.anwen.xiaoying.identity.dto.UserResponse;
import com.anwen.xiaoying.identity.mapper.UserMapper;
import com.anwen.xiaoying.identity.service.IdentityService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class IdentityServiceImpl implements IdentityService {
    private static final String USER_ID = "userId";
    private final UserMapper users;
    private final AppProperties properties;

    @Override
    public List<UserResponse> demoUsers() {
        requireDemo();
        return users.list();
    }

    @Override
    public UserResponse select(HttpServletRequest request, String userId) {
        requireDemo();
        var user = users.find(Ids.code(userId));
        if (user == null) {
            throw BusinessException.notFound();
        }
        logout(request);
        request.getSession(true).setAttribute(USER_ID, user.id());
        return user;
    }

    @Override
    public UserResponse current(HttpServletRequest request) {
        var session = request.getSession(false);
        var id = session == null ? null : (String) session.getAttribute(USER_ID);
        var user = id == null ? null : users.find(id);
        if (user == null) {
            throw new BusinessException(401, "UNAUTHENTICATED", "请先选择演示用户");
        }
        return user;
    }

    @Override
    public void logout(HttpServletRequest request) {
        var session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
    }

    private void requireDemo() {
        if (!properties.demoMode()) {
            throw BusinessException.notFound();
        }
    }
}
