FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /workspace
COPY backend/ backend/
COPY assets/demo/ assets/demo/
WORKDIR /workspace/backend
RUN --mount=type=cache,target=/root/.m2 sh ./mvnw -B -DskipTests package

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app && mkdir data && chown app:app data
COPY --from=build /workspace/backend/target/xiaoying-backend-0.0.1-SNAPSHOT.jar app.jar
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
