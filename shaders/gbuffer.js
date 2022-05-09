/*
 * File: gbuffer.js
 * Author: Nathan Hunter
 * Date: May 7, 2022
 *
 * Purpose: Uses MRT to compose GBuffer used in deferred rendering.
 * 
 *          It is possible to remove the position buffer and store the
 *          x/y/z in the alpha channel of the normal, tangent, and UV 
 *          buffers.
 */

gbuffer_shader = {

    vertex: `#version 300 es
    precision highp float;

    layout(location = 0) in vec3 aPosition;
    layout(location = 1) in vec3 aNormal;
    layout(location = 2) in vec3 aTangent;
    layout(location = 3) in vec2 aUV;

    out vec3 position;
    out vec2 UV;
    out mat3 TBN;

    uniform mat4 projection;
    uniform mat4 model;
    uniform mat4 modelView;

    void main(void) {
        
	    vec3 T = normalize(vec3(model * vec4(aTangent, 0.0)));
	    vec3 N = normalize(vec3(model * vec4(aNormal,  0.0)));
	    vec3 B = cross(T, N);
	    TBN = mat3(T, B, N);
        
        UV = aUV;
        vec4 pos = vec4(aPosition, 1.0);
        position = vec3(model * pos);

        gl_Position = projection * modelView * pos;
       
    }
    `,

    fragment: `#version 300 es
    precision highp float;

    in vec3 position;
    in vec2 UV;
    in mat3 TBN;

    layout(location = 0) out vec3 out_FragPosition;
    layout(location = 1) out vec4 out_FragAlbedo;
    layout(location = 2) out vec3 out_FragNormal;
    layout(location = 3) out vec3 out_FragMaterial;

    uniform sampler2D albedoTexture;
    uniform sampler2D normalTexture;
    uniform sampler2D materialTexture;

    void main(void) {

        out_FragPosition = position;
        out_FragAlbedo = texture(albedoTexture, UV);
        out_FragNormal = normalize(TBN * (texture(normalTexture, UV).rgb * 2.0 - 1.0));
        out_FragMaterial = texture(materialTexture, UV).rgb;

    }
    `
}