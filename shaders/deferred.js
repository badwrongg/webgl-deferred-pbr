/*
 * File: deferred.js
 * Author: Nathan Hunter
 * Date: May 7, 2022
 *
 * Purpose: Uses Gbuffer to perform deferred rendering.
 *          Ues PBR-Metallic workflow consisting of: albedo, 
 *          metallic, roughness, ambient occlusion, and normal
 *          fragment data.  
 *          
 *          Material texture uses RGB for:
 *          R - metallic
 *          G - roughness
 *          B - ambient occlusion
 *          
 *          Uses point lights with position, color, and attenuation
 *          values.  Attenuation uses XYZ for:
 *          X - constant
 *          Y - linear
 *          Z - quadratic
 *          
 *          Alpha channels could be used for emissive or other properties.
 *          Or if memory usage needs to be reduced the position buffer
 *          can be removed and the alpha of the other three buffers can store
 *          the x/y/z of each fragment.
 */

deferred_shader = {

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

    #define M_PI   3.1415926535897932384626433832795
	#define M_PI_2 1.5707963267948966192313216916398
	#define M_2PI  6.283185307179586476925286766559
	#define M_3PI  9.4247779607693797153879301498385

    const vec3 dielectric = vec3(0.4);

    vec3 fresnel(float cosTheta, vec3 mat)
	{
	    return mat + (1.0 - mat) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
	}

	float distribution(vec3 fragNorm, vec3 halfNorm, float roughness)
	{
		roughness *= roughness;
		roughness *= roughness;
	    float FdotH  = max(dot(fragNorm, halfNorm), 0.0);
	    float denom = (FdotH * FdotH * (roughness - 1.0) + 1.0);

	    return roughness / (M_PI * denom * denom);
	}

	float reflection(float num, float roughness)
	{
	    float r = (roughness + 1.0);
	    float k = (r*r) / 8.0;
	    float denom = num * (1.0 - k) + k;

	    return num / denom;
	}

    float geometry(vec3 norm, vec3 view, vec3 light, float roughness)
    {
        float NdotV = max(dot(norm, view), 0.0);
        float NdotL = max(dot(norm, light), 0.0);

        return reflection(NdotL, roughness) * reflection(NdotV, roughness);
    }

    in vec2 UV;

    layout(location = 0) out vec4 out_FragColour;

    uniform sampler2D albedoTexture;
    uniform sampler2D normalTexture;
    uniform sampler2D materialTexture;
    uniform sampler2D positionTexture;
    uniform vec3 cameraPosition;
    uniform vec3 lights[100];

    void main(void) {

        // Final color RGB
        vec3 color = vec3(0.0);
        
        // Gbuffer samples
        vec3 position = texture(positionTexture, UV).rgb;
        vec3 albedo   = texture(albedoTexture, UV).rgb;
        vec3 material = texture(materialTexture, UV).rgb;
        vec3 fragNorm = texture(normalTexture, UV).rgb;

        // Unpack material
        vec3 ao = material.b * albedo;
        float metallic = material.r;
        float roughness = material.g;

        // Only calculate once per fragment
        vec3 viewNorm = normalize(cameraPosition - position);
	    vec3 matRef = mix(dielectric, albedo, metallic);
	    float FdotV = max(dot(fragNorm, viewNorm), 0.0);
	    float reflNorm = reflection(FdotV, roughness);
	    FdotV *= 4.0;

        // Unpack light params
        vec3 params = lights[0];
        int count = int(params.x);
        float ambient = params.y;
        float intensity = params.z;

        // Loop through lights
        for (int i = 1; i < count; i++) {

            vec3 lightPos = lights[i++];
            vec3 lightColor = lights[i++] / 255.0;
            vec3 lightAtten = lights[i];

            // Calculate this light
            vec3 lightDir  = lightPos - position;
		    vec3 lightNorm = normalize(lightDir);
		    vec3 halfNorm = normalize(viewNorm + lightNorm);
		    float FdotL = max(dot(fragNorm, lightNorm), 0.0);

            // Attenuation
            float lightDist = max(length(lightDir), 0.000001);
            float attenuation = 1.0 / (intensity * (lightAtten.x + lightAtten.y * lightDist + lightAtten.z * lightDist * lightDist));

            // PBR lighting
		    vec3 freq       = fresnel(max(dot(halfNorm, viewNorm), 0.0), matRef);
            float geo       = geometry(fragNorm, viewNorm, lightNorm, roughness);
		    vec3 numerator  = distribution(fragNorm, halfNorm, roughness) * geo * freq;
		    vec3 specular   = numerator / (FdotV * FdotL + 0.00000001);
		    vec3 refraction = (vec3(1.0) - freq) * (1.0 - metallic);

            color += lightColor * attenuation * FdotL * (refraction * albedo / M_PI + specular);

        }
            
        // Ambient
        color += vec3(ambient) * albedo * ao;

        // Gamma correction
        color = color / (color + vec3(1.0));
        color = pow(color, vec3(1.0/2.2));
    
		out_FragColour = vec4(color, 1.0);

    }
    `
}