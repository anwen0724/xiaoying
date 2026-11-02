package com.anwen.xiaoying.common;

import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.LinkedHashMap;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(BusinessException.class)
    ResponseEntity<ApiError> business(BusinessException error) {
        return response(error.getStatus(), error.getCode(), error.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> fields(MethodArgumentNotValidException error) {
        var fields = new LinkedHashMap<String, String>();
        error.getBindingResult().getFieldErrors().forEach(field ->
            fields.putIfAbsent(field.getField(), field.getDefaultMessage()));
        return ResponseEntity.badRequest().body(new ApiError("VALIDATION_ERROR", "请求参数不符合要求", fields));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, ConstraintViolationException.class,
        MissingServletRequestParameterException.class, MethodArgumentTypeMismatchException.class,
        MissingServletRequestPartException.class, HandlerMethodValidationException.class})
    ResponseEntity<ApiError> invalid(Exception error) {
        return response(400, "VALIDATION_ERROR", "请求字段、类型或取值不符合要求");
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ApiError> tooLarge() {
        return response(413, "FILE_TOO_LARGE", "图片或上传请求超过大小限制");
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    ResponseEntity<ApiError> unsupported() {
        return response(415, "UNSUPPORTED_MEDIA_TYPE", "不支持此内容类型");
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<ApiError> missing() {
        return response(404, "NOT_FOUND", "资源不存在");
    }

    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<ApiError> database(DataAccessException error) {
        log.error("Database request failed", error);
        return response(503, "DEPENDENCY_UNAVAILABLE", "数据库暂时不可用");
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> unexpected(Exception error) {
        log.error("Unhandled request failure", error);
        return response(500, "INTERNAL_ERROR", "服务暂时无法完成请求");
    }

    private ResponseEntity<ApiError> response(int status, String code, String message) {
        return ResponseEntity.status(status).body(new ApiError(code, message));
    }
}
