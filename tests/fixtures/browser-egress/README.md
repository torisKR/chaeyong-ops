These are TEST-ONLY self-signed TLS certificate and private key fixtures for
`public.egress.test` and `second.egress.test`. They are generated test data,
contain no real credentials, and are never used for a deployed service.

The browser egress integration test uses them on a local fixture server to
verify HTTPS redirects and the original TLS SNI through the SOCKS tunnel.
