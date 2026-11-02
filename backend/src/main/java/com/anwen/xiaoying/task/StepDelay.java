package com.anwen.xiaoying.task;

/** 时间边界：生产等待指定毫秒，测试可用事件闸门控制执行时序。 */
@FunctionalInterface
public interface StepDelay {
    void pause(int milliseconds) throws InterruptedException;
}
