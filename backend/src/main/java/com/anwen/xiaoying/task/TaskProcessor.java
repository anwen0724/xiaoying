package com.anwen.xiaoying.task;

import com.anwen.xiaoying.asset.FileStorage;
import com.anwen.xiaoying.asset.service.AssetService;
import com.anwen.xiaoying.common.BusinessException;
import com.anwen.xiaoying.task.dto.*;
import com.anwen.xiaoying.task.mapper.TaskInputMapper;
import com.anwen.xiaoying.template.service.TemplateService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class TaskProcessor {
    private final TaskStore store;
    private final TaskInputMapper inputs;
    private final AssetService assets;
    private final TemplateService templates;
    private final FileStorage files;
    private final ObjectMapper json;
    private final StepDelay delay;

    public void execute(String id) {
        Stage current = Stage.MATERIAL_CHECK;
        try {
            var task = store.claim(id);
            if (task == null) {
                return;
            }
            var simulation = json.readValue(task.getSimulationConfig(), Simulation.class);
            var template = templates.require(task.getTemplateId());
            byte[] generated = null;
            for (var stage : Stage.values()) {
                current = stage;
                delay.pause(simulation.stepDelayMs());
                if (stage == simulation.failAtStage()) {
                    store.fail(id, stage, "SIMULATED_FAILURE", "按演示配置触发阶段失败");
                    return;
                }
                String resultPath = null;
                switch (stage) {
                    case MATERIAL_CHECK -> assets.validateInputs(task.getUserId(), template, inputs.assets(id));
                    case MOCK_GENERATION -> generated = templates.publicResource(template.getResultPresetPath())
                        .getContentAsByteArray();
                    case RESULT_FINALIZATION -> {
                        resultPath = "results/" + id + "/result.svg";
                        files.write(resultPath, generated);
                        files.readable(resultPath);
                    }
                }
                store.completeStage(id, stage, resultPath);
            }
        } catch (Exception exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            log.error("任务执行失败 id={} stage={}", id, current, exception);
            String code = switch (current) {
                case MATERIAL_CHECK -> exception instanceof BusinessException business
                    && !business.getCode().equals("FILE_UNAVAILABLE") ? "MATERIAL_INVALID" : "MATERIAL_UNAVAILABLE";
                case MOCK_GENERATION -> "GENERATION_FAILED";
                case RESULT_FINALIZATION -> "RESULT_STORAGE_FAILED";
            };
            if (!(exception instanceof BusinessException) && !(exception instanceof java.io.IOException)) {
                code = "TASK_EXECUTION_ERROR";
            }
            try {
                store.fail(id, current, code, "阶段处理失败，请重新创建任务");
            } catch (Exception persistenceError) {
                log.error("任务失败状态无法保存 id={}", id, persistenceError);
            }
        }
    }
}
