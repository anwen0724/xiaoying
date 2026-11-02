package com.anwen.xiaoying.task.entity;

import com.anwen.xiaoying.task.dto.Stage;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.Instant;

@Data
@TableName("tasks")
public class TaskEntity {
    private String id;
    private String userId;
    private String templateId;
    private String templateTitle;
    private String status;
    private Stage stage;
    private long version;
    private String failureCode;
    private String failureReason;
    private String resultPath;
    private Instant createdAt;
    private Instant startedAt;
    private Instant finishedAt;
    private String simulationConfig;
}
