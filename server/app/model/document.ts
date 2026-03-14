import { Application } from 'egg';
import { DataTypes, Model, Optional } from 'sequelize';

interface DocumentAttributes {
  id: number;
  doc_id: string;
  filename: string;
  original_content: string;
  status: 'uploaded' | 'cleaning' | 'cleaned' | 'splitting' | 'completed' | 'failed';
  created_at: Date;
  updated_at: Date;
}

type DocumentCreationAttributes = Optional<DocumentAttributes, 'id' | 'created_at' | 'updated_at'>;

export default (app: Application) => {
  const DocumentModel = app.model.define<Model<DocumentAttributes, DocumentCreationAttributes>>(
    'documents',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      doc_id: {
        type: DataTypes.STRING(36),
        allowNull: false,
        unique: true,
      },
      filename: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      original_content: {
        type: DataTypes.TEXT('long'),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('uploaded', 'cleaning', 'cleaned', 'splitting', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'uploaded',
      },
      created_at: DataTypes.DATE,
      updated_at: DataTypes.DATE,
    },
    {
      tableName: 'documents',
    },
  );

  return DocumentModel;
};
