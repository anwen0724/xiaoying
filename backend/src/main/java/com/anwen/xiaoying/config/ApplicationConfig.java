package com.anwen.xiaoying.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.time.Clock;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.cfg.CoercionAction;
import com.fasterxml.jackson.databind.cfg.CoercionInputShape;
import com.fasterxml.jackson.databind.type.LogicalType;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import com.anwen.xiaoying.task.StepDelay;
import java.io.IOException;
import java.util.concurrent.ThreadPoolExecutor;

@Configuration
@EnableConfigurationProperties(AppProperties.class)
public class ApplicationConfig implements WebMvcConfigurer {
    private static final DateTimeFormatter API_TIME = new DateTimeFormatterBuilder().appendInstant(3).toFormatter();

    @Bean
    StepDelay stepDelay() {
        return Thread::sleep;
    }

    @Bean
    Jackson2ObjectMapperBuilderCustomizer strictJson() {
        return builder -> {
            builder.postConfigurer(mapper -> {
                var strings = mapper.coercionConfigFor(LogicalType.Textual);
                strings.setCoercion(CoercionInputShape.Integer, CoercionAction.Fail);
                strings.setCoercion(CoercionInputShape.Float, CoercionAction.Fail);
                strings.setCoercion(CoercionInputShape.Boolean, CoercionAction.Fail);
            });
            builder.serializerByType(Instant.class, new JsonSerializer<Instant>() {
                @Override
                public void serialize(Instant value, JsonGenerator output, SerializerProvider provider) throws IOException {
                    output.writeString(API_TIME.format(value));
                }
            });
        };
    }

    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }

    @Bean
    ThreadPoolTaskExecutor taskExecutor(AppProperties properties) {
        var executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(properties.taskWorkers());
        executor.setMaxPoolSize(properties.taskWorkers());
        executor.setQueueCapacity(properties.taskQueueCapacity());
        executor.setThreadNamePrefix("creation-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(10);
        return executor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override
            public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
                response.setHeader("Cache-Control", "no-store");
                return true;
            }
        }).addPathPatterns("/api/**");
    }
}
