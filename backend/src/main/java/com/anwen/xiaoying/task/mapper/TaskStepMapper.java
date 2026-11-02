package com.anwen.xiaoying.task.mapper;

import com.anwen.xiaoying.task.dto.*;
import org.apache.ibatis.annotations.*;
import java.time.Instant;
import java.util.List;

@Mapper
public interface TaskStepMapper {
    @Insert("INSERT INTO task_steps(task_id, stage, position) VALUES(#{id}, #{stage}, #{position})")
    void insert(@Param("id") String id, @Param("stage") Stage stage, @Param("position") int position);

    @Select("SELECT stage,status,started_at,finished_at,failure_reason FROM task_steps WHERE task_id=#{id} ORDER BY position")
    List<TaskStep> list(String id);

    @Update("UPDATE task_steps SET status='RUNNING', started_at=#{now} WHERE task_id=#{id} AND stage=#{stage} AND status='PENDING'")
    int start(@Param("id") String id, @Param("stage") Stage stage, @Param("now") Instant now);

    @Update("""
        UPDATE task_steps SET status=#{status}, finished_at=#{now}, failure_reason=#{reason}
        WHERE task_id=#{id} AND stage=#{stage} AND status='RUNNING'
        """)
    int finish(@Param("id") String id, @Param("stage") Stage stage, @Param("status") String status,
               @Param("now") Instant now, @Param("reason") String reason);

    @Update("UPDATE task_steps SET status='SKIPPED', finished_at=#{now} WHERE task_id=#{id} AND status='PENDING'")
    void skipPending(@Param("id") String id, @Param("now") Instant now);
}
