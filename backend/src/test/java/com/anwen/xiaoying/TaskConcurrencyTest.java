package com.anwen.xiaoying;

import com.anwen.xiaoying.task.StepDelay;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mock.web.*;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "app.task-queue-capacity=1")
@AutoConfigureMockMvc
@Import(TaskConcurrencyTest.TimeBoundary.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class TaskConcurrencyTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired GateDelay gate;

    @TestConfiguration
    static class TimeBoundary {
        @Bean @Primary
        GateDelay controlledDelay() { return new GateDelay(); }

        @Bean @Primary
        Clock fixedClock() { return Clock.fixed(Instant.parse("2030-01-01T00:00:00Z"), ZoneOffset.UTC); }
    }

    static class GateDelay implements StepDelay {
        final CountDownLatch entered = new CountDownLatch(2);
        final CountDownLatch release = new CountDownLatch(1);

        @Override
        public void pause(int milliseconds) throws InterruptedException {
            entered.countDown();
            if (!release.await(20, TimeUnit.SECONDS)) {
                throw new IllegalStateException("测试闸门未释放");
            }
        }
    }

    @Test
    void twoWorkersQueueOverflowAndLogoutDoNotRunWorkOnRequestThread() throws Exception {
        var session = login("demo-alice");
        String asset = upload(session);
        List<String> accepted = new ArrayList<>();
        try {
            accepted.add(create(session, asset).get("id").asText());
            accepted.add(create(session, asset).get("id").asText());
            assertThat(gate.entered.await(5, TimeUnit.SECONDS)).isTrue();
            accepted.add(create(session, asset).get("id").asText());
            assertThat(detail(session, accepted.get(0)).get("status").asText()).isEqualTo("RUNNING");
            assertThat(detail(session, accepted.get(1)).get("status").asText()).isEqualTo("RUNNING");
            assertThat(detail(session, accepted.get(2)).get("status").asText()).isEqualTo("QUEUED");
            var overflow = create(session, asset);
            assertThat(overflow.get("status").asText()).isEqualTo("FAILED");
            assertThat(overflow.at("/failure/code").asText()).isEqualTo("EXECUTOR_CAPACITY_EXCEEDED");
            var rejected = detail(session, overflow.get("id").asText());
            for (var step : rejected.get("steps")) {
                assertThat(step.get("status").asText()).isEqualTo("SKIPPED");
            }
            mvc.perform(delete("/api/session").session(session)).andExpect(status().isNoContent());
        } finally {
            gate.release.countDown();
        }
        var newSession = login("demo-alice");
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
            for (String id : accepted) {
                var done = detail(newSession, id);
                assertThat(done.get("status").asText()).isEqualTo("SUCCEEDED");
                assertThat(done.get("version").asInt()).isEqualTo(4);
            }
        });
        mvc.perform(get("/api/tasks/status").session(newSession).param("ids", String.join(",", accepted)))
            .andExpect(status().isOk()).andExpect(jsonPath("items.length()").value(3))
            .andExpect(jsonPath("items[0].id").value(accepted.getFirst()));
    }

    private MockHttpSession login(String user) throws Exception {
        return (MockHttpSession) mvc.perform(post("/api/session").contentType("application/json")
                .content(json.writeValueAsBytes(Map.of("userId", user))))
            .andExpect(status().isOk()).andReturn().getRequest().getSession(false);
    }

    private String upload(MockHttpSession session) throws Exception {
        var result = mvc.perform(multipart("/api/assets")
                .file(new MockMultipartFile("file", "mountain.png", "image/png",
                    new ClassPathResource("demo/inputs/mountain.png").getContentAsByteArray()))
                .param("templateId", "minimal-cover").session(session))
            .andExpect(status().isCreated()).andReturn();
        return json.readTree(result.getResponse().getContentAsByteArray()).get("id").asText();
    }

    private JsonNode create(MockHttpSession session, String asset) throws Exception {
        var result = mvc.perform(post("/api/tasks").session(session).contentType("application/json")
                .content(json.writeValueAsBytes(Map.of("templateId", "minimal-cover", "assetIds", List.of(asset)))))
            .andExpect(status().isAccepted()).andReturn();
        return json.readTree(result.getResponse().getContentAsByteArray());
    }

    private JsonNode detail(MockHttpSession session, String id) throws Exception {
        return json.readTree(mvc.perform(get("/api/tasks/" + id).session(session))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray());
    }
}
