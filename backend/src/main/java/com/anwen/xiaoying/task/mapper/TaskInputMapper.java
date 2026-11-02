package com.anwen.xiaoying.task.mapper;

import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface TaskInputMapper {
    @Insert("INSERT INTO task_inputs(task_id, position, asset_id) VALUES(#{taskId}, #{position}, #{assetId})")
    void insert(@Param("taskId") String taskId, @Param("position") int position, @Param("assetId") String assetId);

    @Select("SELECT asset_id FROM task_inputs WHERE task_id=#{taskId} ORDER BY position")
    List<String> assets(String taskId);
}
