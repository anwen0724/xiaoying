package com.anwen.xiaoying.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties("app")
public record AppProperties(@NotBlank String storageRoot, boolean demoMode,
                            @Min(1) int taskWorkers, @Min(1) int taskQueueCapacity,
                            @Min(0) @Max(30000) int simulationStepDelayMs) {
}
