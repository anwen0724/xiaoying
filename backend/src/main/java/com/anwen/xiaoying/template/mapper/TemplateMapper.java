package com.anwen.xiaoying.template.mapper;

import com.anwen.xiaoying.template.entity.TemplateEntity;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface TemplateMapper extends BaseMapper<TemplateEntity> {
    @Select("SELECT 1")
    int ping();
}
