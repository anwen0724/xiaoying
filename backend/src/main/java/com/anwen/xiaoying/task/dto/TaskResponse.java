package com.anwen.xiaoying.task.dto;

import com.anwen.xiaoying.task.entity.TaskEntity;
import java.time.Instant;

public record TaskResponse(String id, String templateId, String templateTitle, String status,
        Stage stage, long version, Instant createdAt, Instant startedAt, Instant finishedAt,
        String resultUrl, Failure failure) {
    public record Failure(String code, Stage stage, String message) {}

    public static TaskResponse from(TaskEntity task) {
        var failure = task.getFailureCode() == null ? null
            : new Failure(task.getFailureCode(), task.getStage(), task.getFailureReason());
        return new TaskResponse(task.getId(), task.getTemplateId(), task.getTemplateTitle(),
            task.getStatus(), task.getStage(), task.getVersion(), task.getCreatedAt(),
            task.getStartedAt(), task.getFinishedAt(),
            "SUCCEEDED".equals(task.getStatus()) ? "/api/tasks/" + task.getId() + "/result" : null, failure);
    }
}
