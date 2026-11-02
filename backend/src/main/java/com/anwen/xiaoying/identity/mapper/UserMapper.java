package com.anwen.xiaoying.identity.mapper;

import com.anwen.xiaoying.identity.dto.UserResponse;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface UserMapper {
    @Select("SELECT id, display_name FROM users WHERE id = #{id}")
    UserResponse find(String id);

    @Select("SELECT id, display_name FROM users ORDER BY id")
    List<UserResponse> list();
}
