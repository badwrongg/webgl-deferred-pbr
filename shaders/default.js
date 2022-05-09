/*
 * File: default.js
 * Author: Nathan Hunter
 * Date: May 7, 2022
 *
 * Purpose: Basic shader for testing purposes 
 *          with normal mapping and texture.
 *          Hardcoded light as example.
 */

default_shader = {

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
	    vec3 B = cross(N, T);
	    TBN = mat3(T, B, N);

        UV = aUV;
        gl_Position = projection * modelView * vec4(aPosition, 1.0);
        position = vec3(model * vec4(aPosition, 1.0));
    }
    `,

    fragment: `#version 300 es
    precision highp float;

    const vec3 lightCoord = vec3(0.0, 50.0, 50.0);
    const vec4 lightColor = vec4(0.4, 0.5, 0.8, 1.0);
    const vec4 lightSpecular = vec4(1.0, 1.0, 1.0, 1.0);

    in vec3 position;
    in vec2 UV;
    in mat3 TBN;

    layout(location = 0) out vec4 out_FragColour;

    uniform sampler2D albedoTexture;
    uniform sampler2D normalTexture;
    uniform vec3 cameraPosition;

    void main(void) {

        vec4 fragColor = texture(albedoTexture, UV);
        vec3 viewNorm  = normalize(cameraPosition - position);
        vec3 fragNorm  = normalize(TBN * (texture(normalTexture, UV).rgb * 2.0 - 1.0));
        vec3 lightDir  = lightCoord - position;
		vec3 lightNorm = normalize(lightDir);

        float lightDist = max(length(lightDir), 0.000001);
        float attenuation = 1.0 / (0.01 * (0.1 + 0.05 * lightDist + 0.01 * lightDist * lightDist));
        float diffuseAmount  = max(dot(lightNorm, fragNorm), 0.0);

        vec3 halfVector = normalize(lightNorm + viewNorm);
        float specularAmount = pow(max(dot(fragNorm, halfVector), 0.0), 16.0) * 0.2;
 
		vec4 diffuse  = lightColor  * diffuseAmount * attenuation;
		vec4 specular = lightSpecular * specularAmount * attenuation;

		out_FragColour = fragColor * (diffuse + 0.01) + specular;

    }
    `
}