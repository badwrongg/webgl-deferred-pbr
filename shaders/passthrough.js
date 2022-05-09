/*
 * File: passthrough.js
 * Author: Nathan Hunter
 * Date: May 7, 2022
 *
 * Purpose: Generic passthrough shader that 
 *          uses a baseTexture if set.
 */

passthrough_shader = {

    vertex: `#version 300 es
    precision highp float;

    layout(location = 0) in vec3 aPosition;
    layout(location = 1) in vec2 aUV;

    out vec2 UV;

    uniform mat4 projection;
    uniform mat4 model;
    uniform mat4 modelView;

    void main(void) {
        
        UV = aUV;
        gl_Position = projection * modelView * vec4(aPosition, 1.0);
    }
    `,

    fragment: `#version 300 es
    precision highp float;

    in vec2 UV;

    layout(location = 0) out vec4 out_FragColour;

    uniform sampler2D baseTexture;

    void main(void) {
        out_FragColour = texture(baseTexture, UV);
    }
    `
}