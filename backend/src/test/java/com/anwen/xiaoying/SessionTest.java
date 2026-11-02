package com.anwen.xiaoying;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class SessionTest {
    @Autowired
    MockMvc mvc;

    @Test
    void wrongJsonTypeDoesNotBecomeAUserCode() throws Exception {
        mvc.perform(post("/api/session").contentType("application/json").content("{\"userId\":123}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void selectedIdentitySurvivesAnotherRequestAndLogoutEndsIt() throws Exception {
        mvc.perform(get("/api/session")).andExpect(status().isUnauthorized());
        var login = mvc.perform(post("/api/session").contentType("application/json")
                .content("{\"userId\":\"demo-alice\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("id").value("demo-alice"))
            .andReturn();
        var session = (MockHttpSession) login.getRequest().getSession(false);
        mvc.perform(get("/api/session").session(session))
            .andExpect(status().isOk()).andExpect(jsonPath("displayName").value("小禾"));
        mvc.perform(delete("/api/session").session(session)).andExpect(status().isNoContent());
        mvc.perform(get("/api/session")).andExpect(status().isUnauthorized());
    }
}
