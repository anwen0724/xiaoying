package com.anwen.xiaoying.task.dto;

import java.time.Instant;

public record TaskStep(Stage stage, String status, Instant startedAt, Instant finishedAt, String failureReason) {
}
