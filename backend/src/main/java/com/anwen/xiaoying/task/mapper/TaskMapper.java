package com.anwen.xiaoying.task.mapper;

import com.anwen.xiaoying.task.entity.TaskEntity;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.*;

@Mapper
public interface TaskMapper extends BaseMapper<TaskEntity> {
    @Select("SELECT * FROM tasks WHERE id = #{id} FOR UPDATE")
    TaskEntity lock(String id);

    @Update("""
        UPDATE tasks SET status=#{task.status}, stage=#{task.stage}, version=version+1,
            failure_code=#{task.failureCode}, failure_reason=#{task.failureReason},
            result_path=#{task.resultPath}, started_at=#{task.startedAt}, finished_at=#{task.finishedAt}
        WHERE id=#{task.id} AND status=#{expectedStatus} AND version=#{task.version}
        """)
    int transition(@Param("task") TaskEntity task, @Param("expectedStatus") String expectedStatus);
}
