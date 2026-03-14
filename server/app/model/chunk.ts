import { Application } from 'egg';
import { DataTypes, Model, Optional } from 'sequelize';

interface ChunkAttributes {
  id: number;
  chunk_id: string;
  doc_id: string;
  text: string;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

type ChunkCreationAttributes = Optional<ChunkAttributes, 'id' | 'metadata' | 'created_at' | 'updated_at'>;

export default (app: Application) => {
  const ChunkModel = app.model.define<Model<ChunkAttributes, ChunkCreationAttributes>>(
    'chunks',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      chunk_id: {
        type: DataTypes.STRING(36),
        allowNull: false,
        unique: true,
      },
      doc_id: {
        type: DataTypes.STRING(36),
        allowNull: false,
      },
      text: {
        type: DataTypes.TEXT('medium'),
        allowNull: false,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      created_at: DataTypes.DATE,
      updated_at: DataTypes.DATE,
    },
    {
      tableName: 'chunks',
      indexes: [
        { fields: ['doc_id'] },
      ],
    },
  );

  return ChunkModel;
};
