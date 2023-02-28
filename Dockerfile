FROM rust

RUN apt update && apt install -y ffmpeg libavformat-dev libavcodec-dev libavcodec-dev libswscale-dev libavutil-dev libswresample-dev clang

RUN git clone https://github.com/FFMS/ffms2.git && \
    cd ffms2 && \
    git checkout 55c2af5 && \
    ./autogen.sh &&\
    make -j64 &&\
    make install

RUN curl -fsSL https://deno.land/x/install/install.sh | sh

COPY ./ffms-segmenter /app/ffms-segmenter

ENV DENO_INSTALL="/root/.deno"
ENV PATH="$DENO_INSTALL/bin:$PATH"

WORKDIR /app/ffms-segmenter
RUN cargo build --release

COPY . /app

WORKDIR /app

ENV LD_LIBRARY_PATH="$LD_LIBRARY_PATH:/usr/local/lib/"

ENTRYPOINT [ "deno", "run", "-A", "main.ts" ]
# CMD [ "bash" ]
# CMD [ "deno", "run", "-A", "main.ts" ]
# ENTRYPOINT [ "cargo", "build", "--release" ]
# ENTRYPOINT [ "/bin/bash", "-l", "-c" ]