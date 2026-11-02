package com.anwen.xiaoying;

import org.apache.ibatis.annotations.Mapper;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan(basePackages = "com.anwen.xiaoying", annotationClass = Mapper.class)
public class XiaoyingApplication {
    public static void main(String[] args) {
        SpringApplication.run(XiaoyingApplication.class, args);
    }
}
