package com.anwen.xiaoying.identity.api;

import com.anwen.xiaoying.common.Items;
import com.anwen.xiaoying.identity.dto.UserResponse;
import com.anwen.xiaoying.identity.service.IdentityService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class SessionController {
    private final IdentityService identity;

    public record SelectUserRequest(@NotBlank @Size(max = 64) String userId) {
    }

    @GetMapping("/demo-users")
    Items<UserResponse> users() {
        return new Items<>(identity.demoUsers());
    }

    @PostMapping("/session")
    UserResponse select(HttpServletRequest request, @Valid @RequestBody SelectUserRequest body) {
        return identity.select(request, body.userId());
    }

    @GetMapping("/session")
    UserResponse current(HttpServletRequest request) {
        return identity.current(request);
    }

    @DeleteMapping("/session")
    ResponseEntity<Void> logout(HttpServletRequest request) {
        identity.logout(request);
        var cookie = ResponseCookie.from("JSESSIONID", "").path("/").httpOnly(true)
            .sameSite("Lax").secure(request.isSecure()).maxAge(0).build();
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookie.toString()).build();
    }
}
