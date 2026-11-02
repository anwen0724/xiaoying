package com.anwen.xiaoying.task;

import com.anwen.xiaoying.task.dto.Stage;
import com.anwen.xiaoying.task.entity.TaskEntity;
import com.anwen.xiaoying.task.mapper.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/** 每次状态变更只持有短事务，任务与步骤一并提交。 */
@Component
@RequiredArgsConstructor
public class TaskStore {
    private final TaskMapper tasks;
    private final TaskInputMapper inputs;
    private final TaskStepMapper steps;
    private final Clock clock;

    @Transactional
    public void create(TaskEntity task, List<String> assetIds) {
        tasks.insert(task);
        for (int index = 0; index < assetIds.size(); index++) {
            inputs.insert(task.getId(), index + 1, assetIds.get(index));
        }
        for (var stage : Stage.values()) {
            steps.insert(task.getId(), stage, stage.ordinal() + 1);
        }
    }

    @Transactional
    public TaskEntity claim(String id) {
        var task = tasks.lock(id);
        if (task == null || !"QUEUED".equals(task.getStatus())) {
            return null;
        }
        Instant now = now();
        task.setStatus("RUNNING");
        task.setStage(Stage.MATERIAL_CHECK);
        task.setStartedAt(now);
        save(task, "QUEUED");
        requireChanged(steps.start(id, Stage.MATERIAL_CHECK, now));
        return task;
    }

    @Transactional
    public void completeStage(String id, Stage stage, String resultPath) {
        var task = tasks.lock(id);
        if (!"RUNNING".equals(task.getStatus()) || task.getStage() != stage) {
            throw new IllegalStateException("任务阶段发生冲突");
        }
        Instant now = now();
        requireChanged(steps.finish(id, stage, "SUCCEEDED", now, null));
        if (stage == Stage.RESULT_FINALIZATION) {
            task.setStatus("SUCCEEDED");
            task.setFinishedAt(now);
            task.setResultPath(resultPath);
        } else {
            var next = Stage.values()[stage.ordinal() + 1];
            task.setStage(next);
            requireChanged(steps.start(id, next, now));
        }
        save(task, "RUNNING");
    }

    @Transactional
    public void fail(String id, Stage stage, String code, String reason) {
        var task = tasks.lock(id);
        String expected = stage == null ? "QUEUED" : "RUNNING";
        if (!expected.equals(task.getStatus()) || task.getStage() != stage) {
            return;
        }
        Instant now = now();
        task.setStatus("FAILED");
        task.setFinishedAt(now);
        task.setFailureCode(code);
        task.setFailureReason(reason);
        if (stage != null) {
            requireChanged(steps.finish(id, stage, "FAILED", now, reason));
        }
        steps.skipPending(id, now);
        save(task, expected);
    }

    private void save(TaskEntity task, String expectedStatus) {
        requireChanged(tasks.transition(task, expectedStatus));
        task.setVersion(task.getVersion() + 1);
    }

    private void requireChanged(int count) {
        if (count != 1) {
            throw new IllegalStateException("任务状态更新发生冲突");
        }
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MILLIS);
    }
}
