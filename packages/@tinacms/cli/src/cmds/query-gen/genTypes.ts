/**
Copyright 2021 Forestry.io Holdings, Inc.
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { GraphQLSchema, printSchema } from 'graphql'
import { TinaCloudSchema } from '@tinacms/schema-tools'

import fs from 'fs-extra'
import p from 'path'
import { generateTypes } from '../../codegen'
import { logText, warnText } from '../../utils/theme'
import { logger } from '../../logger'
export const TINA_HOST = 'content.tinajs.io'
const root = process.cwd()
const generatedPath = p.join(root, '.tina', '__generated__')

export async function genClient(
  { tinaSchema }: { tinaSchema: TinaCloudSchema<false> },
  next: () => void,
  options
) {
  const branch = tinaSchema?.config?.branch
  const clientId = tinaSchema?.config?.clientId
  const token = tinaSchema?.config?.token

  if (!branch || !clientId || !token) {
    logger.warn(
      // TODO: add link to docs
      warnText('Client not configured properly. Skipping client generation.')
    )
    return next()
  }

  const apiURL = options.local
    ? 'http://localhost:4001/graphql'
    : `https://${TINA_HOST}/content/${clientId}/github/${branch}`

  const clientPath = p.join(generatedPath, 'client.ts')
  fs.writeFileSync(
    clientPath,
    `import { createClient } from "tinacms/dist/client";
import { queries } from "./types";
export const client = createClient({ url: '${apiURL}', token: '${token}', queries });
export default client;
  `
  )
  return next()
}

export async function genTypes(
  { schema }: { schema: GraphQLSchema },
  next: () => void,
  options
) {
  const typesPath = process.cwd() + '/.tina/__generated__/types.ts'
  const fragPath = process.cwd() + '/.tina/__generated__/*.{graphql,gql}'
  const queryPathGlob = process.cwd() + '/.tina/queries/**/*.{graphql,gql}'

  const typescriptTypes = await generateTypes(
    schema,
    queryPathGlob,
    fragPath,
    options
  )
  await fs.outputFile(
    typesPath,
    `//@ts-nocheck
// DO NOT MODIFY THIS FILE. This file is automatically generated by Tina
export function gql(strings: TemplateStringsArray, ...args: string[]): string {
  let str = ''
  strings.forEach((string, i) => {
    str += string + (args[i] || '')
  })
  return str
}
${typescriptTypes}
`
  )
  logger.info(`\tTypescript types => ${logText(typesPath)}`)

  const schemaString = await printSchema(schema)
  const schemaPath = process.cwd() + '/.tina/__generated__/schema.gql'

  await fs.outputFile(
    schemaPath,
    `# DO NOT MODIFY THIS FILE. This file is automatically generated by Tina
${schemaString}
schema {
  query: Query
  mutation: Mutation
}
  `
  )
  logger.info(`\tGraphQL types ====> ${logText(schemaPath)}\n`)
  next()
}
