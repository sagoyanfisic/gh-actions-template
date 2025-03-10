import * as core from '@actions/core';
import axios, { AxiosResponse } from 'axios';

/**
 * Interface para la estructura del payload de la solicitud
 */
interface WorkflowSubmitPayload {
  namespace: string;
  resourceKind: string;
  resourceName: string;
  submitOptions: {
    entryPoint: string;
    parameters: string[];
    labels: string;
  };
}

/**
 * Interface simplificada para la respuesta de Argo
 */
interface ArgoWorkflowResponse {
  metadata: {
    name: string;
    namespace: string;
    uid: string;
  };
  status: string;
}

// Eliminada la función validateInput ya que no es necesaria

/**
 * Función principal que ejecuta la acción
 */
async function run(): Promise<void> {
  try {
    // Obtener las entradas de la acción
    const inputs = {
      argoUrl: core.getInput('argo-url', { required: true }),
      authToken: core.getInput('auth-token', { required: true }),
      namespace: core.getInput('namespace', { required: true }),
      resourceKind: core.getInput('resource-kind', { required: true }),
      resourceName: core.getInput('resource-name', { required: true }),
      entryPoint: core.getInput('entry-point', { required: true }),
      repository: core.getInput('repository', { required: true }),
      branch: core.getInput('branch', { required: true }),
      headSha: core.getInput('head-sha', { required: true })
    };
    
    // Construir la URL para el endpoint de la API
    const apiUrl = `${inputs.argoUrl}/api/v1/workflows/${inputs.namespace}/submit`;
    
    // Preparar el payload de la solicitud
    const payload: WorkflowSubmitPayload = {
      namespace: inputs.namespace,
      resourceKind: inputs.resourceKind,
      resourceName: inputs.resourceName,
      submitOptions: {
        entryPoint: inputs.entryPoint,
        parameters: [
          `repository=${inputs.repository}`,
          `branch=${inputs.branch}`,
          `HEAD_SHA=${inputs.headSha}`
        ],
        labels: "submit-from-ui=true"
      }
    };
    
    // Preparar los headers de la solicitud
    const headers = {
      'Content-Type': 'application/json',
      'Accept': '*/*',
      'Origin': inputs.argoUrl,
      'Referer': `${inputs.argoUrl}/workflows/${inputs.namespace}?limit=50&sidePanel=submit-new-workflow`,
      'Cookie': `authorization=Bearer ${inputs.authToken}`
    };
    
    // Registrar información sobre la solicitud que estamos a punto de hacer
    core.info(`Enviando workflow a: ${apiUrl}`);
    
    // Configuración de timeout para la solicitud (30 segundos)
    const TIMEOUT_MS = 30000;
    
    // Realizar la solicitud a la API
    const response: AxiosResponse<ArgoWorkflowResponse> = await axios.post(
      apiUrl, 
      payload, 
      { 
        headers, 
        timeout: TIMEOUT_MS 
      }
    );
    
    // Procesar la respuesta
    const statusCode = response.status;
    core.info(`Código de estado: ${statusCode}`);
    
    if (response.data) {
      const workflowName = response.data.metadata?.name || 'unknown';
      core.info(`Workflow enviado: ${workflowName}`);
      
      // Establecer outputs para acciones posteriores
      core.setOutput('response', JSON.stringify(response.data));
      core.setOutput('workflow_name', workflowName);
    }
    
    core.setOutput('status', statusCode);
    
    // Verificar si la solicitud fue exitosa basado en el código de estado
    if (statusCode >= 200 && statusCode < 300) {
      core.info('✅ Workflow enviado exitosamente');
    } else {
      core.setFailed(`❌ Error al enviar workflow: ${response.statusText}`);
    }
  } catch (error) {
    // Manejar errores simplificado
    if (error instanceof Error) {
      core.setFailed(`❌ Acción fallida con error: ${error.message}`);
    } else {
      core.setFailed(`❌ Ocurrió un error desconocido`);
    }
  }
}

// Ejecutar la acción
run();