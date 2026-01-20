import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// CAMBIO CLAVE: Se usa "export const handler" en lugar de "exports.handler"
export const handler = async (event) => {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    };
    
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers };
    
    try {
        const method = event.httpMethod;
    
        // Lógica sugerida para el GET en tu Lambda
        if (method === 'GET') {
            const fecha = event.queryStringParameters.fecha;
            const result = await docClient.send(new GetCommand({
                TableName: "AulaMood",
                Key: { fecha: fecha }
            }));
            
            // Si el ítem no existe, DEBEMOS devolver un objeto vacío, no null
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ item: result.Item || { totalScore: 0, count: 0 } })
            };
        }

        if (method === 'POST') {
            const body = JSON.parse(event.body);


            if (body.tipo === 'update_codigo') {
                try {
                    // Asegúrate de que 'body.nuevoCodigo' sea exactamente lo que viene en el payload
                    const resultado = await docClient.send(new PutCommand({
                        TableName: "AulaMoodConfiguration",
                        Item: { 
                            id: "codigo_acceso", 
                            valor: body.nuevoCodigo.toUpperCase() 
                        }
                    }));
                    
                    console.log("Guardado con éxito:", resultado);
                    
                    return { 
                        statusCode: 200, 
                        headers, 
                        body: JSON.stringify({ m: "OK", detalle: "Código actualizado" }) 
                    };
                } catch (error) {
                    console.error("Error en DynamoDB:", error);
                    return { 
                        statusCode: 500, 
                        headers, 
                        body: JSON.stringify({ error: error.message }) 
                    };
                }
            }

            if (body.tipo === 'voto') {
                const config = await docClient.send(new GetCommand({
                    TableName: "AulaMoodConfiguration",
                    Key: { id: "codigo_acceso" }
                }));
                
                if (!config.Item || body.codigo !== config.Item.valor) {
                    return { statusCode: 403, headers, body: JSON.stringify({ error: "Invalido" }) };
                }

                await docClient.send(new UpdateCommand({
                    TableName: "AulaMood",
                    Key: { fecha: body.fecha },
                    UpdateExpression: "SET totalScore = if_not_exists(totalScore, :z) + :s, #c = if_not_exists(#c, :z) + :i",
                    ExpressionAttributeNames: { "#c": "count" },
                    ExpressionAttributeValues: { ":s": body.score, ":i": 1, ":z": 0 }
                }));
                return { statusCode: 200, headers, body: JSON.stringify({ m: "Voto OK" }) };
            }
        }
    } catch (err) {
        console.error(err); // Esto te permitirá verlo en CloudWatch
        return { 
            statusCode: 500, 
            headers: {
                "Access-Control-Allow-Origin": "*", // Esto es VITAL
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type"
            }, 
            body: JSON.stringify({ 
                e: err.message,
                stack: err.stack 
            }) 
        };
    }
};