package com.anwen.xiaoying.common;

/** 业务边界错误，同时保留稳定代码和 HTTP 状态。改编自用户初始化模板。 */
public class BusinessException extends RuntimeException {
    private final int status;
    private final String code;

    public BusinessException(int status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public int getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    public static BusinessException notFound() {
        return new BusinessException(404, "NOT_FOUND", "记录不存在或不可访问");
    }

    public static BusinessException invalid(String message) {
        return new BusinessException(400, "VALIDATION_ERROR", message);
    }
}
