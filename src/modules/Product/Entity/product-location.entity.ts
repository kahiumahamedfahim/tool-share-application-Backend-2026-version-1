import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToOne,
    JoinColumn,
} from "typeorm";

import { Product } from "./product.entity";

@Entity("product_locations")
export class ProductLocation {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar", length: 50, unique: true })
    productId!: string;

    @Column({ type: "decimal", precision: 10, scale: 7 })
    latitude!: string;

    @Column({ type: "decimal", precision: 10, scale: 7 })
    longitude!: string;

    @Column({ type: "varchar", length: 100 })
    division!: string;

    @Column({ type: "varchar", length: 100 })
    district!: string;

    @Column({ type: "varchar", length: 100 })
    upazila!: string;

    @Column({ type: "text" })
    pickupAddress!: string;

    @CreateDateColumn({ type: "timestamp" })
    createdAt!: Date;

    @UpdateDateColumn({ type: "timestamp" })
    updatedAt!: Date;

    @OneToOne(() => Product, (product) => product.location, {
        onDelete: "CASCADE",
    })
    @JoinColumn({
        name: "productId",
        referencedColumnName: "productId",
    })
    product!: Product;
}