# Fetched source

- URL: https://docs.pagar.me/reference/simulando-uma-antecipação-spot.md
- Title: 
- Retrieved: 2026-09-07

---

---
updatedAt: 2026-04-06T17:53:37.000Z
---

Fetch the complete documentation index at: https://docs.pagar.me/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# Simulando uma Antecipação Spot

Obtem previsões precisas sobre o valor a ser recebido, os custos envolvidos na operação, e a data de pagamento. Para iniciar a simulação da antecipação, é necessário utilizar a rota:

# OpenAPI definition

```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "pagarme-api",
    "version": "5"
  },
  "servers": [
    {
      "url": "https://api.pagar.me/core/v5"
    }
  ],
  "components": {
    "securitySchemes": {
      "sec0": {
        "type": "http",
        "scheme": "basic"
      }
    }
  },
  "security": [
    {
      "sec0": []
    }
  ],
  "paths": {
    "/recipients/{recipient_id}/bulk_anticipations/simulate": {
      "get": {
        "summary": "Simulando uma Antecipação Spot",
        "description": "Obtem previsões precisas sobre o valor a ser recebido, os custos envolvidos na operação, e a data de pagamento. Para iniciar a simulação da antecipação, é necessário utilizar a rota:",
        "operationId": "simulando-uma-antecipação-spot",
        "parameters": [
          {
            "name": "recipient_id",
            "in": "path",
            "description": "ID do recebedor para o qual deseja simular a antecipação.",
            "schema": {
              "type": "string"
            },
            "required": true
          },
          {
            "name": "timeframe",
            "in": "query",
            "description": "Define o período de onde os recebíveis serão escolhidos para simulação — ou seja, do inicio ou do fim da sua agenda de recebíveis.",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "requested_amount",
            "in": "query",
            "description": "Valor líquido, em centavos, que você deseja receber na antecipação, o valor deve estar entre o limite antecipável do recebedor. Caso queira consultar os limites antecipáveis utilize a rota /limits.",
            "required": true,
            "schema": {
              "type": "integer",
              "format": "int32"
            }
          },
          {
            "name": "payment_date",
            "in": "query",
            "description": "Data que você deseja receber a antecipação em sua conta Pagar.me. O parâmetro payment_date pode ser para qualquer dia no futuro e do dia atual até as 11h, caso já tenha passado desse horário, por favor adicione um payment_date para o próximo dia útil. Data em string no formato ISO 8601",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "200",
            "content": {
              "application/json": {
                "examples": {
                  "Result": {
                    "value": "{\n  \"amount\": 1000000,                \n  \"fee\": 20000,                   \n  \"fraudCoverageFee\": 0,      \n  \"anticipationAmount\": 900000,    \n  \"anticipationFee\": 80000,       \n  \"timeframe\": \"start\",              \n  \"paymentDate\": \"2025-08-10T00:00:00.000Z\",            \n  \"startIntervalDate\": \"2025-08-05T00:00:00.000Z\",\n  \"endIntervalDate\": \"2024-12-18T00:00:00.000Z\"    \n}"
                  }
                },
                "schema": {
                  "type": "object",
                  "properties": {
                    "amount": {
                      "type": "integer",
                      "example": 1000000,
                      "default": 0
                    },
                    "fee": {
                      "type": "integer",
                      "example": 20000,
                      "default": 0
                    },
                    "fraudCoverageFee": {
                      "type": "integer",
                      "example": 0,
                      "default": 0
                    },
                    "anticipationAmount": {
                      "type": "integer",
                      "example": 900000,
                      "default": 0
                    },
                    "anticipationFee": {
                      "type": "integer",
                      "example": 80000,
                      "default": 0
                    },
                    "timeframe": {
                      "type": "string",
                      "example": "start"
                    },
                    "paymentDate": {
                      "type": "string",
                      "example": "2025-08-10T00:00:00.000Z"
                    },
                    "startIntervalDate": {
                      "type": "string",
                      "example": "2025-08-05T00:00:00.000Z"
                    },
                    "endIntervalDate": {
                      "type": "string",
                      "example": "2024-12-18T00:00:00.000Z"
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "400",
            "content": {
              "application/json": {
                "examples": {
                  "Result": {
                    "value": "{ \"errors\": [{ \"type\": \"invalid_parameter_error\", \"parameter_name\": \"payment_date\", \"message\": \"A data de pagamento deve ser um dia útil.\" }] }"
                  }
                },
                "schema": {
                  "type": "object",
                  "properties": {
                    "errors": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "type": {
                            "type": "string",
                            "example": "invalid_parameter_error"
                          },
                          "parameter_name": {
                            "type": "string",
                            "example": "payment_date"
                          },
                          "message": {
                            "type": "string",
                            "example": "A data de pagamento deve ser um dia útil."
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        "deprecated": false
      }
    }
  },
  "x-readme": {
    "headers": [],
    "explorer-enabled": true,
    "proxy-enabled": true
  },
  "x-readme-fauxas": true
}
```