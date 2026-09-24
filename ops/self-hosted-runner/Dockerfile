# Minimal ephemeral GitHub Actions runner for the terraform-dns.yml workflow
# specifically. Namecheap's API only accepts calls from whitelisted IPs, and
# GitHub-hosted runners don't have a static one -- this runs on your own
# machine's (already-whitelisted) IP instead, on demand, via a container that
# registers, does exactly one job, deregisters, and exits. No persistent
# listener process between runs.
#
# Build:  podman build -t wftx-gha-runner:latest .
FROM ghcr.io/actions/actions-runner:latest

USER root
RUN apt-get update && apt-get install -y --no-install-recommends unzip ca-certificates && \
    ARCH=$(dpkg --print-architecture) && \
    curl -fsSL -o /tmp/tf.zip "https://releases.hashicorp.com/terraform/1.16.3/terraform_1.16.3_linux_${ARCH}.zip" && \
    unzip /tmp/tf.zip -d /usr/local/bin && rm /tmp/tf.zip && \
    apt-get purge -y unzip && apt-get autoremove -y && \
    apt-get clean && rm -rf /var/lib/apt/lists/*
USER runner
