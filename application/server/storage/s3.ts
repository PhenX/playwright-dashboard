import type { StorageAdapter, S3Config } from './types'

/**
 * AWS S3 storage adapter
 * Stores files in an S3 bucket
 */
export class S3StorageAdapter implements StorageAdapter {
  private readonly config: S3Config
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private s3Client: any // AWS S3Client instance (type is dynamic)

  constructor(config: S3Config) {
    this.config = config
    this.initializeS3Client()
  }

  private initializeS3Client() {
    try {
      // Dynamically import AWS SDK v3
      // This will only load if S3 storage is actually used
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { S3Client } = require('@aws-sdk/client-s3')

      this.s3Client = new S3Client({
        region: this.config.region,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey
        },
        ...(this.config.endpoint && { endpoint: this.config.endpoint }),
        // Default to path-style when a custom endpoint is set (required for MinIO, LocalStack, etc.)
        forcePathStyle: this.config.forcePathStyle ?? !!this.config.endpoint
      })
    } catch (error) {
      console.error('Failed to initialize S3 client. Make sure @aws-sdk/client-s3 is installed.')
      console.error('Install it with: npm install @aws-sdk/client-s3')
      throw error
    }
  }

  async writeFile(path: string, data: Buffer): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PutObjectCommand } = require('@aws-sdk/client-s3')

      const command = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: path,
        Body: data
      })

      await this.s3Client.send(command)
    } catch (error) {
      console.error(`Failed to write file to S3: ${path}`, error)
      throw error
    }
  }

  async readFile(path: string): Promise<Buffer> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { GetObjectCommand } = require('@aws-sdk/client-s3')

      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: path
      })

      const response = await this.s3Client.send(command)

      // Convert stream to buffer
      const chunks: Buffer[] = []
      // Response.Body is a readable stream from AWS SDK
      // TypeScript doesn't know the exact type, but it's iterable
      const body = response.Body as AsyncIterable<Uint8Array>
      for await (const chunk of body) {
        chunks.push(Buffer.from(chunk))
      }
      return Buffer.concat(chunks)
    } catch (error) {
      console.error(`Failed to read file from S3: ${path}`, error)
      throw error
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { HeadObjectCommand } = require('@aws-sdk/client-s3')

      const command = new HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: path
      })

      await this.s3Client.send(command)
      return true
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false
      }
      console.error(`Failed to check if file exists in S3: ${path}`, error)
      throw error
    }
  }

  async mkdir(_path: string): Promise<void> {
    // S3 doesn't require directory creation
    // Directories are implicit in S3 based on key prefixes
    return Promise.resolve()
  }

  getFullPath(path: string): string {
    // For S3, return the key as-is (relative path)
    return path
  }

  async deleteDirectory(path: string): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3')

      const prefix = path.endsWith('/') ? path : `${path}/`
      let continuationToken: string | undefined

      do {
        const listCommand = new ListObjectsV2Command({
          Bucket: this.config.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken
        })

        const listResult: {
          Contents?: Array<{ Key: string }>
          IsTruncated?: boolean
          NextContinuationToken?: string
        } = await this.s3Client.send(listCommand)

        if (listResult.Contents && listResult.Contents.length > 0) {
          const deleteCommand = new DeleteObjectsCommand({
            Bucket: this.config.bucket,
            Delete: {
              Objects: listResult.Contents.map((obj: { Key: string }) => ({ Key: obj.Key }))
            }
          })
          await this.s3Client.send(deleteCommand)
        }

        continuationToken = listResult.IsTruncated ? listResult.NextContinuationToken : undefined
      } while (continuationToken)
    } catch (error) {
      console.error(`Failed to delete directory from S3: ${path}`, error)
      throw error
    }
  }
}
