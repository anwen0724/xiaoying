package com.anwen.xiaoying.task.dto;

import com.fasterxml.jackson.annotation.JsonSetter;
import com.fasterxml.jackson.annotation.Nulls;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;
import java.util.List;

@Data
public class CreateTaskRequest {
    @NotBlank @Size(max = 64)
    private String templateId;
    @NotNull
    private List<String> assetIds;
    @Valid
    @JsonSetter(nulls = Nulls.FAIL)
    private SimulationInput simulation;

    @Data
    public static class SimulationInput {
        @Min(0) @Max(30000)
        @JsonSetter(nulls = Nulls.FAIL)
        private Integer stepDelayMs;
        private Stage failAtStage;
    }
}
