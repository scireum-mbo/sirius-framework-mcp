# Storage

The storage module provides a three-layer architecture for managing files and
binary content. Each layer serves a different purpose and can be configured
independently.

## Layer 1 — Physical Storage

Layer 1 handles the raw byte storage. It abstracts over different storage backends:

- **`FSObjectStorageSpace`** — local filesystem storage (development, small deployments)
- **`S3ObjectStorageSpace`** — S3-compatible object storage (production)

Configuration is done per "space" in HOCON:

```hocon
storage.layer1 {
    spaces {
        default {
            engine = "fs"
            basePath = "/data/storage"
        }
        documents {
            engine = "s3"
            bucketName = "my-bucket"
        }
    }
}
```

Key classes:
- `ObjectStorage` — service for accessing storage spaces
- `ObjectStorageSpace` — a configured storage area
- `FileHandle` — represents a downloaded file with metadata

## Layer 2 — Metadata and Blobs

Layer 2 adds metadata, versioning, and variant management on top of Layer 1.
This is the primary API for working with files in application code.

### Core Concepts

- **`BlobStorageSpace`** — a logical container for blobs (configured per space)
- **`Blob`** — a file with metadata (name, size, content type, tenant, etc.)
- **`BlobContainer`** — groups related blobs (e.g., attachments for an entity)
- **`Directory`** — optional directory structure within a space

### JDBC vs MongoDB

Layer 2 metadata can be stored in either database:

| Component       | JDBC                    | MongoDB                  |
|-----------------|-------------------------|--------------------------|
| Storage class   | `SQLBlobStorage`        | `MongoBlobStorage`       |
| Blob entity     | `SQLBlob`               | `MongoBlob`              |
| Directory       | `SQLDirectory`          | `MongoDirectory`         |
| Framework flag  | `biz.storage-blob-jdbc` | `biz.storage-blob-mongo` |

### Referencing Blobs from Entities

Use `BlobHardRef` or `BlobSoftRef` in entity fields:

```java
// Hard ref — blob is deleted when the entity is deleted
private final BlobHardRef logo =
        new BlobHardRef(this, "logo", "tenant-logos");

// Soft ref — blob survives entity deletion
private final BlobSoftRef attachment =
        new BlobSoftRef(this, "attachment", "documents");
```

### Working with Blobs

```java
@Part
private BlobStorage blobStorage;

// Upload
BlobStorageSpace space = blobStorage.getSpace("documents");
Blob blob = space.createBlob("report.pdf", "application/pdf", tenantId);
try (OutputStream out = blob.createOutputStream()) {
    // write content
}

// Download
try (InputStream in = blob.createInputStream()) {
    // read content
}
```

## Layer 3 — Virtual File System (VFS)

Layer 3 provides a unified directory/file tree view over Layer 2 spaces and other
sources. It powers the file manager UI and FTP/WebDAV access.

### VirtualFile

`VirtualFile` is the abstraction for both files and directories:

```java
@Part
private VirtualFileSystem vfs;

VirtualFile root = vfs.root();
VirtualFile docs = root.resolve("documents");
for (VirtualFile child : docs.children()) {
    if (child.isDirectory()) {
        // traverse
    } else {
        // access file content via child.createInputStream()
    }
}
```

### VFS Roots

The VFS tree is assembled from `VFSRoot` implementations. Each root contributes
a subtree (e.g., one root for tenant documents, another for shared templates).
Custom roots are registered via `@Register(classes = VFSRoot.class)`.

## Framework Flags

Storage requires multiple framework flags depending on which layers and backends
you use:

```hocon
sirius.frameworks {
    biz.storage = true             # Core storage (required)
    biz.storage-blob-jdbc = true   # Layer 2 metadata in JDBC
    biz.storage-blob-mongo = false # Layer 2 metadata in MongoDB
    biz.storage-replication-jdbc = false   # Replication tasks in JDBC
    biz.storage-replication-mongo = false  # Replication tasks in MongoDB
}
```

## Common Mistakes

1. **Wrong ref type** — Using `BlobHardRef` when the blob should outlive the entity
   (e.g., shared documents). Use `BlobSoftRef` if the blob has independent lifecycle.

2. **Missing framework flags** — `biz.storage` alone is not enough. You also need
   `biz.storage-blob-jdbc` or `biz.storage-blob-mongo` for Layer 2 to work.

3. **Not closing streams** — Always close `InputStream` and `OutputStream` from blob
   operations. Unclosed streams leak file handles and may corrupt uploads.

4. **Ignoring variants** — Layer 2 supports automatic variant generation (e.g.,
   thumbnails). Configure variants per space rather than generating them manually.
